using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using SiteImprove.Umbraco8.Plugin.Models;

namespace Siteimprove.Services
{
    public interface ISiteImproveUrlMapService
    {
        Task<object> Insert(SiteImproveUrlMap row);

        Task<int> Update(SiteImproveUrlMap row);

        Task<List<SiteImproveUrlMap>> GetAll();

        Task<SiteImproveUrlMap> GetByPageId(int pageId);
        Task<string> GetPageUrlByPageId(int pageId);
    }
}
