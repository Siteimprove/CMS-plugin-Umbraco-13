using System.Text.Encodings.Web;
using System.Reflection;

namespace Siteimprove.Umbraco17.Plugin.Middlewares;

public static class PreviewHtmlInjector
{
    private static readonly string AssetVersion = typeof(PreviewHtmlInjector).Assembly
        .GetCustomAttribute<AssemblyInformationalVersionAttribute>()!.InformationalVersion.Split('+')[0];

    public static string Inject(string html, string pathBase, string? pageUrl, string version)
    {
        var index = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        if (index < 0) return html;
        var encode = HtmlEncoder.Default;
        var session = string.IsNullOrEmpty(pageUrl) ? Guid.NewGuid().ToString("D") : "";
        var script = $"<script src=\"{encode.Encode(pathBase + "/App_Plugins/Siteimprove/preview.js?v=" + Uri.EscapeDataString(AssetVersion))}\" "
            + $"data-siteimprove-preview data-page-url=\"{encode.Encode(pageUrl ?? "")}\" "
            + $"data-preview-session=\"{session}\" "
            + $"data-umbraco-version=\"{encode.Encode(version)}\" defer></script>";
        return html.Insert(index, script);
    }
}
