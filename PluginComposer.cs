using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Siteimprove.Umbraco17.Plugin.Middlewares;
using Siteimprove.Umbraco17.Plugin.Services;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Web.Common.ApplicationBuilder;

namespace Siteimprove.Umbraco17.Plugin;

public sealed class PluginComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.AddOptions<SiteimproveOptions>()
            .Bind(builder.Config.GetSection(SiteimproveOptions.SectionName));
        builder.Services.AddTransient<ISiteimprovePublicUrlService, SiteimprovePublicUrlService>();
        builder.Services.Configure<UmbracoPipelineOptions>(options =>
            options.AddFilter(new UmbracoPipelineFilter("SiteimprovePreview",
                postPipeline: app => app.UseMiddleware<PreviewScriptInjectionMiddleware>())));
    }
}

