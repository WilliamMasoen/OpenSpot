namespace OpenSpot.Ratings.DTOs
{
    public class GetRatingDto
    {
        public Guid Id { get; set; }
        public Guid SaleId { get; set; }
        public string ReviewerId { get; set; } = string.Empty;
        public string ReviewerName { get; set; } = string.Empty;
        public string? ReviewerProfileImageUrl { get; set; }
        public int Stars { get; set; }
        public string? Comment { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
