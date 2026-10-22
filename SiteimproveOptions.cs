namespace Siteimprove.Umbraco17.Plugin;

public sealed class SiteimproveOptions
{
    public const string SectionName = "Siteimprove";
    public bool EnablePreviewChecks { get; set; } = true;
    // When set (including an empty string), overrides the database setting.
    public string? PublicUrl { get; set; }
}
