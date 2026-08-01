using System.Net;

namespace Argyon.Backend.App.Shared.DTO;

public class DTOGeneric
{
    public class DTOResponseApi
    {
        public DTOResponseApi()
        {
            this.Message = string.Empty;
        }
        
        public string Message { get; set; }

        // Machine-readable error code (e.g. "vault_reauth_required", "refresh_reuse_detected"), so
        // the frontend can branch on the failure reason without parsing the localized Message.
        public string? Code { get; set; }
        public HttpStatusCode StatusCode { get; set; }
    }

    public class DTOResponseApiData<T> : DTOResponseApi
    {
        public DTOResponseApiData()
        {
            this.Data = default(T);
        }

        public DTOResponseApiData(T data)
        {
            this.Data = data;
        }
        public T Data { get; set; }
    }

    public class DTOResponseApiListData<T> : DTOResponseApi
    {
        public DTOResponseApiListData()
        {
            this.Data = new List<T>();
        }

        public DTOResponseApiListData(List<T> data)
        {
            this.Data = data;
        }
        public List<T> Data { get; set; }
    }

    public class DTOResponseApiPagedListData<T> : DTOResponseApiListData<T>
    {
        public DTOResponseApiPagedListData() : base()
        {
        }

        public DTOResponseApiPagedListData(List<T> data) : base(data)
        {
        }

        public int TotalCount { get; set; }
    }
}