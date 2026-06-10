using System.ComponentModel.DataAnnotations;

namespace OpenSpot.Ratings.DTOs
{
    public class CreateRatingDto
    {
        [Required]
        public Guid SaleId { get; set; }

        [Range(1, 5)]
        public int Stars { get; set; }

        [MaxLength(500)]
        public string? Comment { get; set; }
    }
}
