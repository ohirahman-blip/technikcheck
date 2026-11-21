export function createPortalApi(client) {
  async function rpc(name, values) {
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    let result;try{result=await client.rpc(name,values).abortSignal(controller.signal);}finally{clearTimeout(timeout);}
    const {data,error}=result;
    if(error) throw new Error(error.code==='PGRST202'?'Die Einrichtung der Datenbank fehlt noch. Bitte die Portal-Migration ausführen.':error.message);
    return data;
  }
  return {
    async list(){
      const active=[];
      for(let offset=0;;offset+=500){const {data,error}=await client.from('technik_requests').select('*').neq('status','erledigt').order('created_at',{ascending:false}).order('id').range(offset,offset+499);if(error)throw new Error(error.message);active.push(...data);if(data.length<500)break;}
      const {data,error}=await client.from('technik_requests').select('*').eq('status','erledigt').order('updated_at',{ascending:false}).limit(200);if(error)throw new Error(error.message);return [...active,...data];
    },
    issue:(id,greeting)=>rpc('admin_issue_setup',{p_customer_id:id,p_greeting:greeting}),
    update:(id,status,notes)=>rpc('admin_update_request',{p_id:id,p_status:status,p_notes:notes}),
    deleteRequest:id=>rpc('admin_delete_request',{p_id:id}),
    revoke:id=>rpc('admin_revoke_customer_access',{p_customer_id:id}),
    enroll:(code,secret)=>rpc('portal_enroll',{p_setup_code:code,p_device_secret:secret}),
    status:secret=>rpc('portal_device_status',{p_device_secret:secret}),
    send:({secret,code})=>rpc('portal_request_help',{p_device_secret:secret||null,p_callback_code:secret?null:code})
  };
}
