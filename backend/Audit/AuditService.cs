using OpenSpot.Data;

namespace OpenSpot.Audit
{
    public class AuditService : IAuditService
    {
        private readonly ApplicationDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public AuditService(ApplicationDbContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        public void Log(string action, string? userId = null, string? entityType = null, string? entityId = null, string? details = null)
        {
            var ip = _httpContextAccessor.HttpContext?.Connection?.RemoteIpAddress?.ToString();
            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                Details = details,
                IpAddress = ip,
                CreatedAt = DateTime.UtcNow,
            });
        }
    }
}
