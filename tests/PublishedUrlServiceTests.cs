using Microsoft.Extensions.Options;
using Moq;
using Siteimprove.Umbraco17.Plugin.Services;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.PublishedCache;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Web;
using Xunit;

namespace Siteimprove.Umbraco17.Plugin.Tests;

public class PublishedUrlServiceTests
{
    [Fact]
    public async Task RenamedDraftResolvesPublishedContentWithPreviewDisabled()
    {
        var fixture = new Fixture();
        fixture.Cache.Setup(c => c.GetByIdAsync(fixture.Key, false)).ReturnsAsync(fixture.Content);
        fixture.Provider.Setup(p => p.GetUrl(fixture.Content, UrlMode.Absolute, "en-US", null))
            .Returns(() =>
            {
                Assert.False(fixture.Accessor.Current!.InPreviewMode);
                Assert.Same(fixture.Context.Object.Content, fixture.Accessor.Current.Content);
                return "https://site.example/services/";
            });
        Assert.Equal("https://site.example/services/", await fixture.Service.GetPageUrlAsync(fixture.Key, "en-US"));
        Assert.Same(fixture.Context.Object, fixture.Accessor.Current);
        Assert.True(fixture.Accessor.Current!.InPreviewMode);
        fixture.Context.Verify(c => c.Dispose(), Times.Never);
    }

    [Fact]
    public async Task NeverPublishedPreviewHasNoLiveUrl()
    {
        var fixture = new Fixture();
        fixture.Cache.Setup(c => c.GetByIdAsync(fixture.Key, false)).ReturnsAsync((IPublishedContent?)null);
        Assert.Null(await fixture.Service.GetPageUrlAsync(fixture.Key));
        fixture.Provider.Verify(p => p.GetUrl(It.IsAny<IPublishedContent>(), It.IsAny<UrlMode>(), It.IsAny<string?>(), It.IsAny<Uri?>()), Times.Never);
        Assert.Same(fixture.Context.Object, fixture.Accessor.Current);
    }

    [Fact]
    public async Task UnpublishedCultureHasNoLiveUrl()
    {
        var fixture = new Fixture();
        var type = Mock.Of<IPublishedContentType>(t => t.Variations == ContentVariation.Culture);
        var cultures = new Dictionary<string, PublishedCultureInfo> { ["en-US"] = null! };
        var content = Mock.Of<IPublishedContent>(c => c.ContentType == type
            && c.Cultures == cultures);
        fixture.Cache.Setup(c => c.GetByIdAsync(fixture.Key, false)).ReturnsAsync(content);
        Assert.Null(await fixture.Service.GetPageUrlAsync(fixture.Key, "da-DK"));
        fixture.Provider.Verify(p => p.GetUrl(It.IsAny<IPublishedContent>(), It.IsAny<UrlMode>(), It.IsAny<string?>(), It.IsAny<Uri?>()), Times.Never);
    }

    [Fact]
    public async Task ProviderFailureRestoresTheOriginalPreviewContext()
    {
        var fixture = new Fixture();
        fixture.Cache.Setup(c => c.GetByIdAsync(fixture.Key, false)).ReturnsAsync(fixture.Content);
        fixture.Provider.Setup(p => p.GetUrl(fixture.Content, UrlMode.Absolute, null, null))
            .Throws(new InvalidOperationException("Provider failed"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Service.GetPageUrlAsync(fixture.Key));
        Assert.Same(fixture.Context.Object, fixture.Accessor.Current);
        Assert.True(fixture.Accessor.Current!.InPreviewMode);
    }

    [Fact]
    public async Task CustomProviderUrlRetainsItsPathAndConfiguredOrigin()
    {
        var fixture = new Fixture(new SiteimproveOptions { PublicUrl = "https://public.example:8443" });
        fixture.Cache.Setup(c => c.GetByIdAsync(fixture.Key, false)).ReturnsAsync(fixture.Content);
        fixture.Provider.Setup(p => p.GetUrl(fixture.Content, UrlMode.Absolute, "da-DK", null))
            .Returns("https://custom.example/da/custom-route/?page=1");
        Assert.Equal("https://public.example:8443/da/custom-route/?page=1", await fixture.Service.GetPageUrlAsync(fixture.Key, "da-DK"));
        Assert.Same(fixture.Context.Object, fixture.Accessor.Current);
    }

    private sealed class Fixture
    {
        public Guid Key { get; } = Guid.NewGuid();
        public Mock<IPublishedContentCache> Cache { get; } = new();
        public Mock<IUmbracoContext> Context { get; } = new();
        public Mock<IPublishedUrlProvider> Provider { get; } = new();
        public Accessor Accessor { get; } = new();
        public IPublishedContent Content { get; } = Mock.Of<IPublishedContent>(c =>
            c.ContentType == Mock.Of<IPublishedContentType>() && c.Cultures == new Dictionary<string, PublishedCultureInfo>());
        public SiteimprovePublicUrlService Service { get; }

        public Fixture(SiteimproveOptions? options = null)
        {
            Context.SetupGet(c => c.InPreviewMode).Returns(true);
            Context.SetupGet(c => c.Content).Returns(Cache.Object);
            Accessor.Set(Context.Object);
            var factory = new Mock<IUmbracoContextFactory>();
            factory.Setup(f => f.EnsureUmbracoContext()).Returns(() => new UmbracoContextReference(Context.Object, false, Accessor));
            Service = new SiteimprovePublicUrlService(factory.Object, Mock.Of<IKeyValueService>(),
                Provider.Object, Options.Create(options ?? new SiteimproveOptions()), Accessor);
        }
    }

    private sealed class Accessor : IUmbracoContextAccessor
    {
        public IUmbracoContext? Current { get; private set; }
        public bool TryGetUmbracoContext(out IUmbracoContext context)
        {
            context = Current!;
            return Current is not null;
        }
        public void Clear() => Current = null;
        public void Set(IUmbracoContext context) => Current = context;
    }
}
