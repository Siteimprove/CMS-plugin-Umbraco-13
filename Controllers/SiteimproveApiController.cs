using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Siteimprove.Umbraco17.Plugin.Services;
using Umbraco.Cms.Api.Management.Controllers;
using Umbraco.Cms.Api.Management.Routing;
using Umbraco.Cms.Core.Configuration;
using Umbraco.Cms.Web.Common.Authorization;

namespace Siteimprove.Umbraco17.Plugin.Controllers;

[ApiVersion("1.0")]
[VersionedApiBackOfficeRoute("siteimprove")]
[ApiExplorerSettings(GroupName = "Siteimprove")]
public sealed class SiteimproveController(
    ISiteimprovePublicUrlService publicUrlService,
    IUmbracoVersion umbracoVersion) : ManagementApiControllerBase
{
    [HttpGet("public-url")]
    [Authorize(Policy = AuthorizationPolicies.RequireAdminAccess)]
    public IActionResult GetPublicUrl() => Ok(new PublicUrlResponse(publicUrlService.Get() ?? "", publicUrlService.IsConfigured));

    [HttpPut("public-url")]
    [Authorize(Policy = AuthorizationPolicies.RequireAdminAccess)]
    public IActionResult SetPublicUrl([FromBody] PublicUrlRequest request)
    {
        if (publicUrlService.IsConfigured)
            return Conflict(new ProblemDetails { Title = "The public URL is managed by application configuration." });
        if (!PublicUrlMapper.TryNormalizeOrigin(request.PublicUrl, out var origin))
            return BadRequest(new ProblemDetails { Title = "Enter an HTTP or HTTPS origin without a path, query, or fragment." });
        publicUrlService.Set(origin);
        return Ok(new PublicUrlResponse(publicUrlService.Get() ?? "", false));
    }

    [HttpGet("version")]
    public IActionResult Version() => Ok(new { version = umbracoVersion.Version.ToString() });

    [HttpGet("document/{id:guid}/url")]
    [Authorize(Policy = AuthorizationPolicies.TreeAccessDocuments)]
    public async Task<IActionResult> PageUrl(Guid id, [FromQuery] string? culture)
    {
        var url = await publicUrlService.GetPageUrlAsync(id, culture);
        return Ok(new { url });
    }
}

public sealed record PublicUrlRequest(string PublicUrl);
public sealed record PublicUrlResponse(string PublicUrl, bool IsConfigured);

