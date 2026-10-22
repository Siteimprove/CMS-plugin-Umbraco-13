using Umbraco.Cms.Core.PublishedCache;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Web;

namespace Siteimprove.Umbraco17.Plugin.Services;

// Used only during synchronous URL resolution; this view does not own the request context.
internal sealed class PublishedUrlContext(IUmbracoContext context) : IUmbracoContext
{
    public DateTime ObjectCreated => context.ObjectCreated;
    public Uri OriginalRequestUrl => context.OriginalRequestUrl;
    public Uri CleanedUmbracoUrl => context.CleanedUmbracoUrl;
    public IPublishedContentCache Content => context.Content;
    public IPublishedMediaCache Media => context.Media;
    public IDomainCache Domains => context.Domains;
    public IPublishedRequest? PublishedRequest
    {
        get => context.PublishedRequest;
        set => context.PublishedRequest = value;
    }
    public bool IsDebug => context.IsDebug;
    public bool InPreviewMode => false;
    public void Dispose() { }
}
