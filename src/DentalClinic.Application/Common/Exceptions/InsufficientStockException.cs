namespace DentalClinic.Application.Common.Exceptions;

public class InsufficientStockException : Exception
{
    public InsufficientStockException(string message) : base(message) { }
}
