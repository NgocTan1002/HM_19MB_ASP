using System.Security.Cryptography;
using HM_19MB_Core.Data;
using Npgsql;

namespace HM_19MB_API.Services;

public sealed class AuthService
{
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(7);
    private static readonly TimeSpan ResetLifetime = TimeSpan.FromMinutes(30);

    public async Task<AuthResult> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(request.Email);
        var fullName = request.FullName.Trim();

        ValidatePassword(request.Password);

        if (string.IsNullOrWhiteSpace(fullName))
        {
            throw new ArgumentException("Vui lòng nhập họ tên.");
        }

        await DatabaseService.EnsureSchemaAsync();
        await using var conn = new NpgsqlConnection(DatabaseService.ConnectionString);
        await conn.OpenAsync(cancellationToken);

        var passwordHash = HashPassword(request.Password);

        await using var cmd = new NpgsqlCommand(@"
            INSERT INTO nguoi_dung (ho_ten, email, mat_khau_hash)
            VALUES (@fullName, @email, @passwordHash)
            RETURNING id, ho_ten, email, vai_tro", conn);

        cmd.Parameters.AddWithValue("@fullName", fullName);
        cmd.Parameters.AddWithValue("@email", email);
        cmd.Parameters.AddWithValue("@passwordHash", passwordHash);

        try
        {
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            await reader.ReadAsync(cancellationToken);

            var user = ReadUser(reader);
            await reader.DisposeAsync();

            var token = await CreateSessionAsync(conn, user.Id, cancellationToken);
            return new AuthResult(user, token);
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            throw new InvalidOperationException("Email này đã được đăng ký.");
        }
    }

    public async Task<AuthResult> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(request.Email);

        await DatabaseService.EnsureSchemaAsync();
        await using var conn = new NpgsqlConnection(DatabaseService.ConnectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new NpgsqlCommand(@"
            SELECT id, ho_ten, email, vai_tro, mat_khau_hash
            FROM nguoi_dung
            WHERE email = @email", conn);

        cmd.Parameters.AddWithValue("@email", email);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new UnauthorizedAccessException("Email hoặc mật khẩu không đúng.");
        }

        var user = new AuthUser(
            reader.GetInt32(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3));
        var passwordHash = reader.GetString(4);
        await reader.DisposeAsync();

        if (!VerifyPassword(request.Password, passwordHash))
        {
            throw new UnauthorizedAccessException("Email hoặc mật khẩu không đúng.");
        }

        await using (var updateCmd = new NpgsqlCommand(@"
            UPDATE nguoi_dung
            SET lan_dang_nhap_cuoi = NOW()
            WHERE id = @id", conn))
        {
            updateCmd.Parameters.AddWithValue("@id", user.Id);
            await updateCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        var token = await CreateSessionAsync(conn, user.Id, cancellationToken);
        return new AuthResult(user, token);
    }

    public async Task<AuthUser?> GetUserByTokenAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        await DatabaseService.EnsureSchemaAsync();
        await using var conn = new NpgsqlConnection(DatabaseService.ConnectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new NpgsqlCommand(@"
            SELECT u.id, u.ho_ten, u.email, u.vai_tro
            FROM phien_dang_nhap s
            JOIN nguoi_dung u ON u.id = s.nguoi_dung_id
            WHERE s.token_hash = @tokenHash
              AND s.het_han > NOW()", conn);

        cmd.Parameters.AddWithValue("@tokenHash", HashToken(token));

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? ReadUser(reader)
            : null;
    }

    public async Task LogoutAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        await DatabaseService.EnsureSchemaAsync();
        await using var conn = new NpgsqlConnection(DatabaseService.ConnectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new NpgsqlCommand(@"
            DELETE FROM phien_dang_nhap
            WHERE token_hash = @tokenHash", conn);

        cmd.Parameters.AddWithValue("@tokenHash", HashToken(token));
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<ForgotPasswordResponse> RequestPasswordResetAsync(
        ForgotPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(request.Email);

        await DatabaseService.EnsureSchemaAsync();
        await using var conn = new NpgsqlConnection(DatabaseService.ConnectionString);
        await conn.OpenAsync(cancellationToken);

        var userId = await FindUserIdByEmailAsync(conn, email, cancellationToken);
        if (userId == null)
        {
            return new ForgotPasswordResponse(
                "Nếu email tồn tại, yêu cầu đặt lại mật khẩu đã được tạo.",
                null,
                null);
        }

        var token = CreateToken();
        await using var cmd = new NpgsqlCommand(@"
            INSERT INTO token_dat_lai_mat_khau
                (token_hash, nguoi_dung_id, het_han)
            VALUES (@tokenHash, @userId, @expiresAt)", conn);

        cmd.Parameters.AddWithValue("@tokenHash", HashToken(token));
        cmd.Parameters.AddWithValue("@userId", userId.Value);
        cmd.Parameters.AddWithValue("@expiresAt", DateTime.UtcNow.Add(ResetLifetime));
        await cmd.ExecuteNonQueryAsync(cancellationToken);

        return new ForgotPasswordResponse(
            "Yêu cầu đặt lại mật khẩu đã được tạo.",
            token,
            $"/reset-password?token={Uri.EscapeDataString(token)}");
    }

    public async Task ResetPasswordAsync(
        ResetPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidatePassword(request.NewPassword);

        await DatabaseService.EnsureSchemaAsync();
        await using var conn = new NpgsqlConnection(DatabaseService.ConnectionString);
        await conn.OpenAsync(cancellationToken);
        await using var tx = await conn.BeginTransactionAsync(cancellationToken);

        await using var findCmd = new NpgsqlCommand(@"
            SELECT nguoi_dung_id
            FROM token_dat_lai_mat_khau
            WHERE token_hash = @tokenHash
              AND het_han > NOW()
              AND da_su_dung = FALSE", conn, tx);

        findCmd.Parameters.AddWithValue("@tokenHash", HashToken(request.Token));

        var userId = await findCmd.ExecuteScalarAsync(cancellationToken);
        if (userId == null)
        {
            throw new InvalidOperationException("Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
        }

        await using (var updateCmd = new NpgsqlCommand(@"
            UPDATE nguoi_dung
            SET mat_khau_hash = @passwordHash
            WHERE id = @userId", conn, tx))
        {
            updateCmd.Parameters.AddWithValue("@passwordHash", HashPassword(request.NewPassword));
            updateCmd.Parameters.AddWithValue("@userId", (int)userId);
            await updateCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var consumeCmd = new NpgsqlCommand(@"
            UPDATE token_dat_lai_mat_khau
            SET da_su_dung = TRUE
            WHERE token_hash = @tokenHash", conn, tx))
        {
            consumeCmd.Parameters.AddWithValue("@tokenHash", HashToken(request.Token));
            await consumeCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var sessionsCmd = new NpgsqlCommand(@"
            DELETE FROM phien_dang_nhap
            WHERE nguoi_dung_id = @userId", conn, tx))
        {
            sessionsCmd.Parameters.AddWithValue("@userId", (int)userId);
            await sessionsCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
    }

    private static async Task<int?> FindUserIdByEmailAsync(
        NpgsqlConnection conn,
        string email,
        CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(@"
            SELECT id
            FROM nguoi_dung
            WHERE email = @email", conn);

        cmd.Parameters.AddWithValue("@email", email);
        var value = await cmd.ExecuteScalarAsync(cancellationToken);
        return value is int id ? id : null;
    }

    private static async Task<string> CreateSessionAsync(
        NpgsqlConnection conn,
        int userId,
        CancellationToken cancellationToken)
    {
        var token = CreateToken();
        await using var cmd = new NpgsqlCommand(@"
            INSERT INTO phien_dang_nhap (token_hash, nguoi_dung_id, het_han)
            VALUES (@tokenHash, @userId, @expiresAt)", conn);

        cmd.Parameters.AddWithValue("@tokenHash", HashToken(token));
        cmd.Parameters.AddWithValue("@userId", userId);
        cmd.Parameters.AddWithValue("@expiresAt", DateTime.UtcNow.Add(SessionLifetime));
        await cmd.ExecuteNonQueryAsync(cancellationToken);

        return token;
    }

    private static AuthUser ReadUser(NpgsqlDataReader reader)
        => new(
            reader.GetInt32(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3));

    private static string NormalizeEmail(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized) ||
            !normalized.Contains('@', StringComparison.Ordinal))
        {
            throw new ArgumentException("Vui lòng nhập email hợp lệ.");
        }

        return normalized;
    }

    private static void ValidatePassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
        {
            throw new ArgumentException("Mật khẩu phải có ít nhất 8 ký tự.");
        }
    }

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            100_000,
            HashAlgorithmName.SHA256,
            32);

        return $"pbkdf2_sha256$100000${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        var parts = storedHash.Split('$');
        if (parts.Length != 4 ||
            parts[0] != "pbkdf2_sha256" ||
            !int.TryParse(parts[1], out var iterations))
        {
            return false;
        }

        var salt = Convert.FromBase64String(parts[2]);
        var expected = Convert.FromBase64String(parts[3]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            iterations,
            HashAlgorithmName.SHA256,
            expected.Length);

        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    private static string CreateToken()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

public sealed record AuthUser(
    int Id,
    string FullName,
    string Email,
    string Role);

public sealed record AuthResult(
    AuthUser User,
    string Token);

public sealed class RegisterRequest
{
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}

public sealed class LoginRequest
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}

public sealed class ForgotPasswordRequest
{
    public string Email { get; set; } = "";
}

public sealed record ForgotPasswordResponse(
    string Message,
    string? ResetToken,
    string? ResetUrl);

public sealed class ResetPasswordRequest
{
    public string Token { get; set; } = "";
    public string NewPassword { get; set; } = "";
}
