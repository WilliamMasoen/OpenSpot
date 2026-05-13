using System.ComponentModel.DataAnnotations;
using OpenSpot.Listings.Models;
using OpenSpot.Users.Models;

namespace OpenSpot.Listings.DTOs
{
    public class CreateListingDto
    {
        [Required]
        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        public string Address { get; set; } = string.Empty;

        [Required]
        public int Price { get; set; }

        [Required]
        public DateOnly StartDate { get; set; }

        [Required]
        public DateOnly EndDate { get; set; }

        // Pre-resolved coordinates from the client's address autocomplete.
        // When provided, geocoding is skipped.
        public double? Latitude { get; set; }

        public double? Longitude { get; set; }
    }
}