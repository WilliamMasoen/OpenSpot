using System.ComponentModel.DataAnnotations.Schema;
using OpenSpot.Listings.Models;
using OpenSpot.Users.Models;

namespace OpenSpot.Sales.Models
{
    public class Sale
    {
        public Guid Id { get; set; }

        public Guid ListingId { get; set; }

        [ForeignKey("ListingId")]
        public Listing Listing { get; set; } = null!;

        public string SellerId { get; set; } = string.Empty;

        [ForeignKey("SellerId")]
        public User Seller { get; set; } = null!;

        public string BuyerId { get; set; } = string.Empty;

        [ForeignKey("BuyerId")]
        public User Buyer { get; set; } = null!;

        public DateTime CreatedAt { get; set; }
    }
}
