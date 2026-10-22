using Siteimprove.Umbraco17.Plugin.Services;
using Xunit;

namespace Siteimprove.Umbraco17.Plugin.Tests;

public class PublicUrlMapperTests
{
    [Theory]
    [InlineData("https://www.example.com/", "https://www.example.com")]
    [InlineData(" http://localhost:8080/ ", "http://localhost:8080")]
    [InlineData("", "")]
    public void AcceptsOriginsAndNormalizes(string input, string expected)
    {
        Assert.True(PublicUrlMapper.TryNormalizeOrigin(input, out var actual));
        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("https://user:password@example.com")]
    [InlineData("https://example.com/subdirectory")]
    [InlineData("https://example.com/?key=value")]
    [InlineData("https://example.com/#fragment")]
    [InlineData("not-a-url")]
    public void RejectsInvalidDomains(string input)
        => Assert.False(PublicUrlMapper.TryNormalizeOrigin(input, out _));

    [Theory]
    [InlineData("https://public.example.com", "https://public.example.com/path/?q=a%20b")]
    [InlineData("http://localhost:9000", "http://localhost:9000/path/?q=a%20b")]
    [InlineData("", "https://internal.example.com:8443/path/?q=a%20b")]
    [InlineData("invalid-legacy-setting", "https://internal.example.com:8443/path/?q=a%20b")]
    public void PreservesPathAndQueryWhileReplacingOrigin(string origin, string expected)
        => Assert.Equal(expected, PublicUrlMapper.Map("https://internal.example.com:8443/path/?q=a%20b", origin));

    [Theory]
    [InlineData("#")]
    [InlineData("/unpublished/")]
    [InlineData("")]
    public void MissingPublishedUrlHasNoLiveInput(string input)
        => Assert.Null(PublicUrlMapper.Map(input, "https://public.example.com"));
}
