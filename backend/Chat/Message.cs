using System.ComponentModel.DataAnnotations.Schema;
using OpenSpot.Users.Models;

namespace OpenSpot.Chat.Models
{
    public class Message
    {
        public Guid Id { get; set; }

        public Guid ConversationId { get; set; }
        [ForeignKey("ConversationId")]
        public Conversation Conversation { get; set; } = null!;

        public string SenderId { get; set; } = string.Empty;
        [ForeignKey("SenderId")]
        public User Sender { get; set; } = null!;

        public string Body { get; set; } = string.Empty;

        public DateTime SentAt { get; set; }

        public bool IsRead { get; set; }
    }
}
