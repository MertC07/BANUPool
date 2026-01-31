using Microsoft.EntityFrameworkCore;
using BanuPool.Core.Entities;

namespace BanuPool.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<BaseUser> Users { get; set; }
        public DbSet<Student> Students { get; set; }
        public DbSet<Academician> Academicians { get; set; }
        public DbSet<Vehicle> Vehicles { get; set; }
        public DbSet<Ride> Rides { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<Reservation> Reservations { get; set; }

        public DbSet<Review> Reviews { get; set; }

        
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Inheritance Strategy: Table-Per-Hierarchy (TPH) by default
            // Users table will have a "Discriminator" column
            
            // Reservation Relationships
            modelBuilder.Entity<Reservation>()
                .HasOne(r => r.Ride)
                .WithMany(r => r.Reservations)
                .HasForeignKey(r => r.RideId)
                .OnDelete(DeleteBehavior.Restrict); // Prevent cascading delete cycles

            modelBuilder.Entity<Reservation>()
                .HasOne(r => r.Passenger)
                .WithMany()
                .HasForeignKey(r => r.PassengerId)
                .OnDelete(DeleteBehavior.Restrict);

             // Vehicle Relationship
            modelBuilder.Entity<Vehicle>()
                .HasOne(v => v.Owner)
                .WithMany()
                .HasForeignKey(v => v.OwnerId);

            // Review Relationships
            modelBuilder.Entity<Review>()
                .HasOne(r => r.Rater)
                .WithMany()
                .HasForeignKey(r => r.RaterId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Review>()
                .HasOne(r => r.Ratee)
                .WithMany()
                .HasForeignKey(r => r.RateeId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Review>()
                .HasOne(r => r.Ride)
                .WithMany()
                .HasForeignKey(r => r.RideId)
                .OnDelete(DeleteBehavior.Cascade);

            // Notification
            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User)
                .WithMany()
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Notification>()
                .HasOne(n => n.Sender)
                .WithMany()
                .HasForeignKey(n => n.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            // Message Relationships
            modelBuilder.Entity<Message>()
                .HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Message>()
                .HasOne(m => m.Receiver)
                .WithMany()
                .HasForeignKey(m => m.ReceiverId)
                .OnDelete(DeleteBehavior.Restrict);
        }

        public DbSet<Message> Messages { get; set; }
    }
}
