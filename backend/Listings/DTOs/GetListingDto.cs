using OpenSpot.Listings.Models;
using OpenSpot.Users.Models;

namespace OpenSpot.Listings.DTOs
{
    public class GetListingDto
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

        public double? Latitude { get; set; }

        public double? Longitude { get; set; }

        public bool? IsFavorited { get; set; }

        public List<string> ImageUrls { get; set; } = new();

        public string OwnerName { get; set; } = string.Empty;

        public string? OwnerProfileImageUrl { get; set; }

        public double? OwnerAverageRating { get; set; }

        public int OwnerTotalRatings { get; set; }

        public GetListingDto(Listing listing, bool? isFavorited = null, double? ownerAverageRating = null, int ownerTotalRatings = 0)
        {
            Id = listing.Id;
            Title = listing.Title;
            Description = listing.Description;
            Address = listing.Address;
            Price = listing.Price;
            StartDate = listing.StartDate;
            EndDate = listing.EndDate;
            IsAvailable = listing.IsAvailable;
            CreatedAt = listing.CreatedAt;
            OwnerId = listing.OwnerId;
            Latitude = listing.Latitude;
            Longitude = listing.Longitude;
            IsFavorited = isFavorited;
            ImageUrls = listing.Images?.Select(i => i.Url).ToList() ?? new();
            if (listing.Owner is not null)
            {
                OwnerName = $"{listing.Owner.FirstName} {listing.Owner.LastName}".Trim();
                OwnerProfileImageUrl = listing.Owner.ProfileImageUrl;
            }
            OwnerAverageRating = ownerAverageRating;
            OwnerTotalRatings = ownerTotalRatings;
        }

        GetListingDto() { }
    }
}