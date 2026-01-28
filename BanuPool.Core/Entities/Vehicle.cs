namespace BanuPool.Core.Entities
{
    public class Vehicle
    {
        public int Id { get; set; }
        public string PlateNumber { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        
        // Foreign Key
        public int OwnerId { get; set; }
        public BaseUser? Owner { get; set; }
    }
}
