namespace OpenSpot.Email
{
    public interface IEmailService
    {
        Task SendAsync(string to, string subject, string body);
    }
}
