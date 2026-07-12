export const config = { matcher: '/(.*)' };

export default function middleware(req) {
  const auth = req.headers.get('authorization');
  // Username: admin, Password: 123
  const validAuth = 'Basic YWRtaW46MTIz'; 
  
  if (auth !== validAuth) {
    return new Response('Butuh Login', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Aman"' }
    });
  }
}
