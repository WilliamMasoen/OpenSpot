using System.ComponentModel.DataAnnotations.Schema;
using OpenSpot.Listings.Models;
using OpenSpot.Users.Models;

namespace OpenSpot.Chat.Models
{
    public class Conversation
    {
        public Guid Id { get; set; }

        public Guid ListingId { get; set; }
        [ForeignKey("ListingId")]
        public Listing Listing { get; set; } = null!;

        public string BuyerId { get; set; } = string.Empty;
        [ForeignKey("BuyerId")]
        public User Buyer { get; set; } = null!;

        public string OwnerId { get; set; } = string.Empty;
        [ForeignKey("OwnerId")]
        public User Owner { get; set; } = null!;

        public DateTime CreatedAt { get; set; }

        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }
}
