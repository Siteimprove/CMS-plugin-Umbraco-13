using Microsoft.Extensions.Options;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Web;
using Umbraco.Extensions;

namespace Siteimprove.Umbraco17.Plugin.Services;

public sealed class SiteimprovePublicUrlService(
    IUmbracoContextFactory contextFactory, IKeyValueService keyValueService,
    IPublishedUrlProvider urlProvider, IOptions<SiteimproveOptions> options,
    IUmbracoContextAccessor contextAccessor) : ISiteimprovePublicUrlService
{
    // Keep the v13 key so an upgraded database retains the mapping.
    private const string PublicUrlKey = "SiteimprovePublicUrl";
    public bool IsConfigured => options.Value.PublicUrl is not null;
    public string? Get() => options.Value.PublicUrl ?? keyValueService.GetValue(PublicUrlKey);

    public void Set(string publicUrl)
    {
        if (IsConfigured) throw new InvalidOperationException("The public URL is managed by application configuration.");
        if (!PublicUrlMapper.TryNormalizeOrigin(publicUrl, out var origin))
            throw new ArgumentException("Enter an HTTP or HTTPS origin, such as https://www.example.com.", nameof(publicUrl));
        keyValueService.SetValue(PublicUrlKey, origin);
    }

    public async Task<string?> GetPageUrlAsync(Guid key, string? culture = null)
    {
        using var contextRef = contextFactory.EnsureUmbracoContext();
        var content = await contextRef.UmbracoContext.Content.GetByIdAsync(key, preview: false);
        if (content is null || (!string.IsNullOrWhiteSpace(culture)
            && content.ContentType.VariesByCulture() && !content.Cultures.ContainsKey(culture)))
            return null;
        return GetPageUrl(content, culture);
    }

    public string? GetPageUrl(IPublishedContent content, string? culture = null)
    {
        var context = contextAccessor.GetRequiredUmbracoContext();
        if (!context.InPreviewMode)
            return PublicUrlMapper.Map(urlProvider.GetUrl(content, UrlMode.Absolute, culture), Get());

        // URL providers also read request preview state, independently of the content cache.
        contextAccessor.Clear();
        try
        {
            contextAccessor.Set(new PublishedUrlContext(context));
            return PublicUrlMapper.Map(urlProvider.GetUrl(content, UrlMode.Absolute, culture), Get());
        }
        finally
        {
            contextAccessor.Clear();
            contextAccessor.Set(context);
        }
    }
}

