using System.ComponentModel.DataAnnotations.Schema;

namespace OpenSpot.Listings.Models
{
    public class ListingImage
    {
        public Guid Id { get; set; }

        public Guid ListingId { get; set; }

        public string Url { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        [ForeignKey("ListingId")]
        public Listing Listing { get; set; } = null!;
    }
}
