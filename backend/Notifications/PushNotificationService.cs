using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSpot.Data;

namespace OpenSpot.Notifications
{
    public class PushNotificationService : IPushNotificationService
    {
        private readonly ApplicationDbContext _db;
        private readonly IHttpClientFactory _httpFactory;
        private readonly ILogger<PushNotificationService> _logger;

        public PushNotificationService(ApplicationDbContext db, IHttpClientFactory httpFactory, ILogger<PushNotificationService> logger)
        {
            _db = db;
            _httpFactory = httpFactory;
            _logger = logger;
        }

        public async Task SendToUserAsync(string userId, string title, string body)
        {
            var tokens = await _db.PushTokens
                .Where(t => t.UserId == userId)
                .Select(t => t.Token)
                .ToListAsync();

            if (tokens.Count == 0) return;

            var messages = tokens.Select(t => new
            {
                to = t,
                title,
                body,
                sound = "default",
            });

            var json = JsonSerializer.Serialize(messages);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                var http = _httpFactory.CreateClient();
                var response = await http.PostAsync("https://exp.host/push/send", content);
                if (!response.IsSuccessStatusCode)
                    _logger.LogWarning("Expo push returned {Status}", response.StatusCode);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send push notification to user {UserId}", userId);
            }
        }
    }
}
