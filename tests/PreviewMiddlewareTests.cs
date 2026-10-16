using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Siteimprove.Umbraco17.Plugin.Middlewares;
using Siteimprove.Umbraco17.Plugin.Services;
using Umbraco.Cms.Core.Configuration;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Web;
using Xunit;

namespace Siteimprove.Umbraco17.Plugin.Tests;

public class PreviewMiddlewareTests
{
    [Theory]
    [InlineData("https://www.example.com/published-route/")]
    [InlineData(null)]
    public async Task PreviewUsesPublishedLookupAndKeepsUnpublishedPrepublishChecks(string? publishedUrl)
    {
        var context = Context();
        var original = context.Response.Body;
        var key = Guid.NewGuid();
        var content = Mock.Of<IPublishedContent>(c => c.Key == key);
        var request = Mock.Of<IPublishedRequest>(r => r.PublishedContent == content && r.Culture == "en-US");
        var umbracoContext = Mock.Of<IUmbracoContext>(c => c.InPreviewMode && c.PublishedRequest == request);
        var accessor = new Mock<IUmbracoContextAccessor>();
        accessor.Setup(a => a.TryGetUmbracoContext(out umbracoContext)).Returns(true);
        var urls = new Mock<ISiteimprovePublicUrlService>();
        urls.Setup(s => s.GetPageUrlAsync(key, "en-US")).ReturnsAsync(publishedUrl);
        var version = Mock.Of<IUmbracoVersion>(v => v.Version == new Version(17, 0, 0));
        var middleware = new PreviewScriptInjectionMiddleware(async c =>
        {
            c.Response.ContentType = "text/html; charset=utf-8";
            c.Response.ContentLength = 28;
            c.Response.Headers.ETag = "old";
            await c.Response.WriteAsync("<html><body>Hi</body></html>");
        }, NullLogger<PreviewScriptInjectionMiddleware>.Instance);
        await middleware.InvokeAsync(context, Mock.Of<IPreviewService>(s => s.IsInPreview()),
            accessor.Object, urls.Object, version, Options.Create(new SiteimproveOptions()));
        Assert.Same(original, context.Response.Body);
        var output = ((MemoryStream)original).ToArray();
        Assert.Contains("data-siteimprove-preview", Encoding.UTF8.GetString(output));
        Assert.Contains($"data-page-url=\"{publishedUrl ?? ""}\"", Encoding.UTF8.GetString(output));
        urls.Verify(s => s.GetPageUrlAsync(key, "en-US"), Times.Once);
        urls.VerifyNoOtherCalls();
        Assert.Equal(output.Length, context.Response.ContentLength);
        Assert.False(context.Response.Headers.ContainsKey("ETag"));
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task PublicTrafficAndDisabledChecksPassThrough(bool authenticatedPreview, bool enabled)
    {
        var context = Context();
        var original = context.Response.Body;
        var middleware = new PreviewScriptInjectionMiddleware(async c =>
        {
            Assert.Same(original, c.Response.Body);
            await c.Response.WriteAsync("<body>Original</body>");
        }, NullLogger<PreviewScriptInjectionMiddleware>.Instance);
        await middleware.InvokeAsync(context, Mock.Of<IPreviewService>(s => s.IsInPreview() == authenticatedPreview),
            Mock.Of<IUmbracoContextAccessor>(), Mock.Of<ISiteimprovePublicUrlService>(),
            Mock.Of<IUmbracoVersion>(), Options.Create(new SiteimproveOptions { EnablePreviewChecks = enabled }));
        Assert.Equal("<body>Original</body>", Encoding.UTF8.GetString(((MemoryStream)original).ToArray()));
    }

    [Fact]
    public async Task RestoresStreamWhenRenderingThrows()
    {
        var context = Context();
        var original = context.Response.Body;
        var middleware = new PreviewScriptInjectionMiddleware(_ => throw new InvalidOperationException("Rendering failed"),
            NullLogger<PreviewScriptInjectionMiddleware>.Instance);
        await Assert.ThrowsAsync<InvalidOperationException>(() => middleware.InvokeAsync(context,
            Mock.Of<IPreviewService>(s => s.IsInPreview()), Mock.Of<IUmbracoContextAccessor>(),
            Mock.Of<ISiteimprovePublicUrlService>(), Mock.Of<IUmbracoVersion>(),
            Options.Create(new SiteimproveOptions())));
        Assert.Same(original, context.Response.Body);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task PublishedUrlFailurePreservesPreviewUnlessCanceled(bool providerCanceled, bool requestCanceled)
    {
        var context = Context();
        var original = context.Response.Body;
        using var cancellation = new CancellationTokenSource();
        context.RequestAborted = cancellation.Token;
        var key = Guid.NewGuid();
        var content = Mock.Of<IPublishedContent>(c => c.Key == key);
        var request = Mock.Of<IPublishedRequest>(r => r.PublishedContent == content && r.Culture == "en-US");
        var umbracoContext = Mock.Of<IUmbracoContext>(c => c.InPreviewMode && c.PublishedRequest == request);
        var accessor = new Mock<IUmbracoContextAccessor>();
        accessor.Setup(a => a.TryGetUmbracoContext(out umbracoContext)).Returns(true);
        Exception failure = providerCanceled ? new OperationCanceledException() : new InvalidOperationException("URL provider failed");
        var urls = new Mock<ISiteimprovePublicUrlService>();
        urls.Setup(s => s.GetPageUrlAsync(key, "en-US")).Returns(() =>
        {
            if (requestCanceled) cancellation.Cancel();
            return Task.FromException<string?>(failure);
        });
        var logger = new Mock<ILogger<PreviewScriptInjectionMiddleware>>();
        var version = Mock.Of<IUmbracoVersion>(v => v.Version == new Version(17, 7, 1));
        var middleware = new PreviewScriptInjectionMiddleware(async c =>
        {
            c.Response.ContentType = "text/html; charset=utf-8";
            c.Response.Headers.ETag = "original";
            await c.Response.WriteAsync("<html><body>Saved draft</body></html>");
        }, logger.Object);

        var error = await Record.ExceptionAsync(() => middleware.InvokeAsync(context,
            Mock.Of<IPreviewService>(s => s.IsInPreview()), accessor.Object, urls.Object,
            version, Options.Create(new SiteimproveOptions())));

        Assert.Same(original, context.Response.Body);
        if (providerCanceled || requestCanceled)
        {
            Assert.Same(failure, error);
            Assert.Equal(0, original.Length);
            logger.VerifyNoOtherCalls();
            return;
        }

        Assert.Null(error);
        var bytes = ((MemoryStream)original).ToArray();
        var html = Encoding.UTF8.GetString(bytes);
        Assert.Contains("Saved draft", html);
        Assert.Contains("data-siteimprove-preview", html);
        Assert.Contains("data-page-url=\"\"", html);
        var session = System.Text.RegularExpressions.Regex.Match(html, "data-preview-session=\"([^\"]+)\"").Groups[1].Value;
        Assert.True(Guid.TryParse(session, out _));
        Assert.Equal(bytes.Length, context.Response.ContentLength);
        Assert.False(context.Response.Headers.ContainsKey("ETag"));
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
        logger.Verify(l => l.Log(LogLevel.Warning, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(),
            failure, It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
    }

    private static DefaultHttpContext Context()
    {
        var context = new DefaultHttpContext();
        context.Request.Method = "GET";
        context.Request.Headers.Accept = "text/html";
        context.Response.Body = new MemoryStream();
        return context;
    }
}
