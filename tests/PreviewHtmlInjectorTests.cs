using Siteimprove.Umbraco17.Plugin.Middlewares;
using Xunit;

namespace Siteimprove.Umbraco17.Plugin.Tests;

public class PreviewHtmlInjectorTests
{
    [Fact]
    public void InjectsBeforeCaseInsensitiveBodyAndSupportsPathBase()
    {
        var result = PreviewHtmlInjector.Inject("<html><BODY>Hello</BODY></html>", "/site",
            "https://example.com/a?x=1&y=2", "17.0.0");
        Assert.Contains("src=\"/site/App_Plugins/Siteimprove/preview.js?v=1.0.0-beta.8\"", result);
        Assert.Contains("data-page-url=\"https://example.com/a?x=1&amp;y=2\"", result);
        Assert.EndsWith("</script></BODY></html>", result);
    }

    [Fact]
    public void EncodesAttributeValues()
    {
        var result = PreviewHtmlInjector.Inject("<body></body>", "", "\"><script>alert(1)</script>", "17");
        Assert.DoesNotContain("<script>alert(1)</script>", result);
        Assert.Contains("&quot;&gt;&lt;script&gt;", result);
    }

    [Fact]
    public void LeavesResponsesWithoutBodyTagUnchanged()
        => Assert.Equal("fragment", PreviewHtmlInjector.Inject("fragment", "", null, "17"));
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void EveryUrlLessRenderHasAFreshResultSession(string? pageUrl)
    {
        string Session(string html) => System.Text.RegularExpressions.Regex
            .Match(html, "data-preview-session=\"([^\"]+)\"").Groups[1].Value;
        var first = Session(PreviewHtmlInjector.Inject("<body>Draft A</body>", "", pageUrl, "17.7.1"));
        var second = Session(PreviewHtmlInjector.Inject("<body>Draft B</body>", "", pageUrl, "17.7.1"));
        var reload = Session(PreviewHtmlInjector.Inject("<body>Draft A revised</body>", "", pageUrl, "17.7.1"));
        Assert.True(Guid.TryParse(first, out _));
        Assert.True(Guid.TryParse(second, out _));
        Assert.True(Guid.TryParse(reload, out _));
        Assert.Equal(3, new[] { first, second, reload }.Distinct().Count());
    }

    [Fact]
    public void PublishedPreviewsKeepUrlBasedResultHistory()
    {
        var html = PreviewHtmlInjector.Inject("<body>Published</body>", "", "https://example.com/page/", "17.7.1");
        Assert.Contains("data-preview-session=\"\"", html);
    }

}
