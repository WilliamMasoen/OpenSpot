using System.ComponentModel.DataAnnotations.Schema;
using OpenSpot.Users.Models;

namespace OpenSpot.Listings.Models
{
    public class UserFavorite
    {
        public string UserId { get; set; } = string.Empty;

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        public Guid ListingId { get; set; }

        [ForeignKey("ListingId")]
        public Listing Listing { get; set; } = null!;

        public DateTime CreatedAt { get; set; }
    }
}
