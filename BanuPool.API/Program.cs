using System.Text;
using BanuPool.API.Services;
using BanuPool.Core.Interfaces;
using BanuPool.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddOpenApi();
builder.Services.AddOpenApi();

// Database Context
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Dependency Injection
builder.Services.AddScoped<IRideService, RideService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();

// CORS Configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        b => b.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader());
});

// Authentication Configuration
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var key = Encoding.ASCII.GetBytes(jwtSettings["SecretKey"]!);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"]
    };
    
    // SignalR Token Handling (Query String)
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/rideHub"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

// SignalR Service
builder.Services.AddSignalR();

var app = builder.Build();

// Ensure Database exists
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    
    // SAFE MIGRATION: Add IsArchived column if it doesn't exist
    try {
        db.Database.ExecuteSqlRaw("ALTER TABLE Rides ADD COLUMN IsArchived INTEGER DEFAULT 0");
    } catch { }

    try {
        db.Database.ExecuteSqlRaw("ALTER TABLE Rides ADD COLUMN Status INTEGER DEFAULT 0");
    } catch { } 

    // MIGRATION: CancelReason, CancelTime, ReputationScore
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Rides ADD COLUMN CancelReason TEXT"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Rides ADD COLUMN CancelTime TEXT"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN ReputationScore REAL DEFAULT 5.0"); } catch { } 
    
    // MIGRATION: Notifications Table
    try {
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS Notifications (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                UserId INTEGER NOT NULL,
                Title TEXT,
                Message TEXT,
                Type TEXT,
                IsRead INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL
            );
        ");
    } catch { }

    // MIGRATION: Profile Photo
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN ProfilePhotoPath TEXT"); } catch { } 

}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// app.UseHttpsRedirection(); // Disable for local dev to avoid SSL Cert errors in Fetch

app.UseStaticFiles(); // Enable serving files from wwwroot
app.UseCors("AllowAll"); // Enable CORS

app.UseAuthentication(); // Enable Auth
app.UseAuthorization();

app.MapControllers();
app.MapHub<BanuPool.API.Hubs.RideHub>("/rideHub");


app.Run();
