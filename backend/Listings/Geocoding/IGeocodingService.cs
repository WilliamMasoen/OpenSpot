namespace OpenSpot.Listings.Geocoding
{
    public interface IGeocodingService
    {
        Task<(double Lat, double Lng)?> GeocodeAsync(string address, CancellationToken token);
    }
}
