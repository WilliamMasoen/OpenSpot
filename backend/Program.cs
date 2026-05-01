using System.Text;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenSpot.Auth;
using OpenSpot.Config;
using OpenSpot.Data;
using OpenSpot.Data.Interfaces;
using OpenSpot.Email;
using OpenSpot.Listings.Interfaces;
using OpenSpot.Listings.Services;
using OpenSpot.Users.Models;

Env.Load();

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration["DB_CONNECTION_STRING"]
    ?? throw new Exception("Database connection string is missing.");

var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new Exception("JWT secret is missing.");

// --------------------
// Options
// --------------------
builder.Services.Configure<JwtOptions>(o =>
{
    builder.Configuration.GetSection("Jwt").Bind(o);
    o.Secret = jwtSecret;
});
builder.Services.Configure<AppOptions>(builder.Configuration.GetSection("App"));
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));

// --------------------
// Database
// --------------------
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// --------------------
// Identity
// --------------------
builder.Services.AddIdentity<User, IdentityRole>(options =>
{
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.User.RequireUniqueEmail = true;
    options.SignIn.RequireConfirmedEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// --------------------
// Authentication
// --------------------
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };
});

// --------------------
// Services
// --------------------
builder.Services.AddScoped<IApplicationDbContext>(p => p.GetRequiredService<ApplicationDbContext>());
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IListingService, ListingService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// --------------------
// App
// --------------------
var app = builder.Build();

await SeedAsync(app);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "OpenSpot API v1");
        options.RoutePrefix = string.Empty;
    });
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

// --------------------
// Seeding
// --------------------
static async Task SeedAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();

    foreach (var role in new[] { "Admin", "User" })
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));
    }

    var adminEmail = app.Configuration["Admin:Email"] ?? throw new Exception("Admin email not configured.");
    var adminPassword = app.Configuration["Admin:Password"] ?? throw new Exception("Admin password not configured.");

    if (await userManager.FindByEmailAsync(adminEmail) == null)
    {
        var admin = new User
        {
            UserName = adminEmail,
            Email = adminEmail,
            FirstName = "William",
            LastName = string.Empty,
            EmailConfirmed = true
        };

        var result = await userManager.CreateAsync(admin, adminPassword);
        if (result.Succeeded)
            await userManager.AddToRoleAsync(admin, "Admin");
    }
}
