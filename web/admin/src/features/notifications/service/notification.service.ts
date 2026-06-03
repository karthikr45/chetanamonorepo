import { getNotificationApi } from "../api/notification.api";

export async function getNotifications(role:string,branch:string){
   const data= await getNotificationApi(role,branch)
   return data
}