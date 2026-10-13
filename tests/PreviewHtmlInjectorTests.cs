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
        Assert.Contains("src=\"/site/App_Plugins/Siteimprove/preview.js\"", result);
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
}
