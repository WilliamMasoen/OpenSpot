using System.ComponentModel.DataAnnotations;

namespace OpenSpot.Sales.DTOs
{
    public class CreateSaleDto
    {
        [Required]
        public string BuyerId { get; set; } = string.Empty;
    }
}
