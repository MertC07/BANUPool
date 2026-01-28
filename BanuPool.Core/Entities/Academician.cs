namespace BanuPool.Core.Entities
{
    public class Academician : BaseUser
    {
        public string Title { get; set; } = string.Empty; // e.g. "Dr. Öğr. Üyesi"
        public string Department { get; set; } = string.Empty;
    }
}
