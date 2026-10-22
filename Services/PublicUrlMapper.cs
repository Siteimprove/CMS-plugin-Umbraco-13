namespace Siteimprove.Umbraco17.Plugin.Services;

public static class PublicUrlMapper
{
    public static bool TryNormalizeOrigin(string? value, out string origin)
    {
        origin = string.Empty;
        if (string.IsNullOrWhiteSpace(value)) return true;
        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
            || string.IsNullOrEmpty(uri.Host) || !string.IsNullOrEmpty(uri.UserInfo)
            || uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment))
            return false;
        origin = uri.GetLeftPart(UriPartial.Authority);
        return true;
    }

    public static string? Map(string? pageUrl, string? publicUrl)
    {
        if (!Uri.TryCreate(pageUrl, UriKind.Absolute, out var current)
            || (current.Scheme != Uri.UriSchemeHttps && current.Scheme != Uri.UriSchemeHttp))
            return null;

        // Invalid legacy settings must not break content editing.
        if (string.IsNullOrWhiteSpace(publicUrl)
            || !TryNormalizeOrigin(publicUrl, out var origin)
            || !Uri.TryCreate(origin, UriKind.Absolute, out var replacement))
            return current.AbsoluteUri;

        return new UriBuilder(current)
        {
            Scheme = replacement.Scheme,
            Host = replacement.Host,
            Port = replacement.IsDefaultPort ? -1 : replacement.Port
        }.Uri.AbsoluteUri;
    }
}
