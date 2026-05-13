using System.ComponentModel.DataAnnotations.Schema;
using OpenSpot.Users.Models;

namespace OpenSpot.Listings.Models
{
    public class Listing
    {
        public Guid Id { get; set; }

        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public string Address { get; set; } = string.Empty;

        public int Price { get; set; }

        public DateOnly StartDate { get; set; }

        public DateOnly EndDate { get; set; }

        public bool IsAvailable { get; set; }

        public DateTime CreatedAt { get; set; }

        public string OwnerId { get; set; } = string.Empty;

        [ForeignKey("OwnerId")]
        public User Owner { get; set; } = null!;

        public double? Latitude { get; set; }

        public double? Longitude { get; set; }

        public ICollection<ListingImage> Images { get; set; } = new List<ListingImage>();
    }
}