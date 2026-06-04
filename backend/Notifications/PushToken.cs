using OpenSpot.Users.Models;

namespace OpenSpot.Notifications
{
    public class PushToken
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public User User { get; set; } = null!;
        public string Token { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
