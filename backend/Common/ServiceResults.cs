namespace OpenSpot.Common;

public enum ResultStatus
{
    Ok,
    Created,
    NoContent,

    // Expected / business outcomes
    NotFound,
    Conflict,
    Forbidden,
    ValidationError,

    // Unexpected
    Error
}

public class ServiceResult<T>
{
    public bool Success { get; }
    public ResultStatus Status { get; }
    public string? Message { get; }
    public T? Data { get; }

    private ServiceResult(
        bool success,
        ResultStatus status,
        T? data = default,
        string? message = null)
    {
        Success = success;
        Status = status;
        Data = data;
        Message = message;
    }

    // ✅ Success results
    public static ServiceResult<T> Ok(T data)
        => new(true, ResultStatus.Ok, data);

    public static ServiceResult<T> Created(T data)
        => new(true, ResultStatus.Created, data);

    public static ServiceResult<T> NoContent()
        => new(true, ResultStatus.NoContent);

    // ❌ Business / validation failures
    public static ServiceResult<T> Fail(string message, ResultStatus status)
        => new(false, status, default, message);

    // 💥 System error
    public static ServiceResult<T> Error(string message)
        => new(false, ResultStatus.Error, default, message);
}
