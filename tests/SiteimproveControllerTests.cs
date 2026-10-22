using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Siteimprove.Umbraco17.Plugin.Controllers;
using Siteimprove.Umbraco17.Plugin.Services;
using Umbraco.Cms.Core.Actions;
using Umbraco.Cms.Core.Configuration;
using Umbraco.Cms.Core.Security.Authorization;
using Umbraco.Cms.Web.Common.Authorization;
using Xunit;

namespace Siteimprove.Umbraco17.Plugin.Tests;

public class SiteimproveControllerTests
{
    [Fact]
    public async Task DeniedDocumentIsNeverResolved()
    {
        var urls = new Mock<ISiteimprovePublicUrlService>(MockBehavior.Strict);
        var authorization = Authorize(AuthorizationResult.Failed());
        var controller = Controller(urls.Object, authorization.Object);

        Assert.IsType<ForbidResult>(await controller.PageUrl(Guid.NewGuid(), null));
        urls.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("https://example.com/da/page/")]
    [InlineData(null)]
    public async Task AllowedDocumentUsesBrowsePermissionAndPreservesCulture(string? url)
    {
        var id = Guid.NewGuid();
        var urls = new Mock<ISiteimprovePublicUrlService>(MockBehavior.Strict);
        urls.Setup(s => s.GetPageUrlAsync(id, "da-DK")).ReturnsAsync(url);
        var authorization = Authorize(AuthorizationResult.Success());
        var controller = Controller(urls.Object, authorization.Object);

        var response = Assert.IsType<OkObjectResult>(await controller.PageUrl(id, "da-DK"));
        Assert.Equal(JsonSerializer.Serialize(new { url }), JsonSerializer.Serialize(response.Value));
        authorization.Verify(s => s.AuthorizeAsync(controller.User,
            It.Is<ContentPermissionResource>(r => r.ContentKeys.Contains(id)
                && r.ContentKeys.Count() == 1 && r.PermissionsToCheck.Contains(ActionBrowse.ActionLetter)
                && !r.CheckRoot), AuthorizationPolicies.ContentPermissionByResource), Times.Once);
        urls.VerifyAll();
    }

    private static Mock<IAuthorizationService> Authorize(AuthorizationResult result)
    {
        var authorization = new Mock<IAuthorizationService>(MockBehavior.Strict);
        authorization.Setup(s => s.AuthorizeAsync(It.IsAny<ClaimsPrincipal>(),
            It.IsAny<object>(), AuthorizationPolicies.ContentPermissionByResource)).ReturnsAsync(result);
        return authorization;
    }

    private static SiteimproveController Controller(ISiteimprovePublicUrlService urls,
        IAuthorizationService authorization) => new(urls, Mock.Of<IUmbracoVersion>(), authorization)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
}
