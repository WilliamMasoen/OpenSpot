namespace OpenSpot.Notifications
{
    public interface IPushNotificationService
    {
        Task SendToUserAsync(string userId, string title, string body);
    }
}
