using System.Text.Json;

namespace OpenSpot.Listings.Geocoding
{
    public class NominatimGeocodingService : IGeocodingService
    {
        private readonly HttpClient _http;
        private readonly ILogger<NominatimGeocodingService> _logger;

        public NominatimGeocodingService(HttpClient http, ILogger<NominatimGeocodingService> logger)
        {
            _http = http;
            _logger = logger;
        }

        public async Task<(double Lat, double Lng)?> GeocodeAsync(string address, CancellationToken token)
        {
            // Try the address as-is first, then with a city hint as fallback.
            var candidates = new[] { address, $"{address}, Toronto, Canada" };

            foreach (var candidate in candidates)
            {
                var result = await TryGeocodeAsync(candidate, token);
                if (result.HasValue) return result;
            }

            _logger.LogWarning("Geocoding returned no results for address: {Address}", address);
            return null;
        }

        private async Task<(double Lat, double Lng)?> TryGeocodeAsync(string address, CancellationToken token)
        {
            try
            {
                var url = $"https://nominatim.openstreetmap.org/search?q={Uri.EscapeDataString(address)}&format=json&limit=1";
                var response = await _http.GetAsync(url, token);
                if (!response.IsSuccessStatusCode) return null;

                var json = await response.Content.ReadAsStringAsync(token);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (root.GetArrayLength() == 0) return null;

                var first = root[0];
                var lat = double.Parse(first.GetProperty("lat").GetString()!, System.Globalization.CultureInfo.InvariantCulture);
                var lng = double.Parse(first.GetProperty("lon").GetString()!, System.Globalization.CultureInfo.InvariantCulture);
                return (lat, lng);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Geocoding request failed for: {Address}", address);
                return null;
            }
        }
    }
}
