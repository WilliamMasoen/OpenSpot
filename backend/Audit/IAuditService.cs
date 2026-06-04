namespace OpenSpot.Audit
{
    public interface IAuditService
    {
        void Log(string action, string? userId = null, string? entityType = null, string? entityId = null, string? details = null);
    }
}
