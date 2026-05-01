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

        public GetListingDto(Listing listing)
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
        }

        GetListingDto() { }
    }
}