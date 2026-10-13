using Umbraco.Cms.Core.Models.PublishedContent;

namespace Siteimprove.Umbraco17.Plugin.Services;

public interface ISiteimprovePublicUrlService
{
    string? Get();
    bool IsConfigured { get; }
    void Set(string publicUrl);
    Task<string?> GetPageUrlAsync(Guid key, string? culture = null);
    string? GetPageUrl(IPublishedContent content, string? culture = null);
}

