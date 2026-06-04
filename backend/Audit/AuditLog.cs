namespace OpenSpot.Audit
{
    public class AuditLog
    {
        public Guid Id { get; set; }
        public string? UserId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string? EntityType { get; set; }
        public string? EntityId { get; set; }
        public string? Details { get; set; }
        public string? IpAddress { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
