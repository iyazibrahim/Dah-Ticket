import { Navigate, useSearchParams } from 'react-router-dom';

/** Deep-link alias — inventory lives on the main /itam hub. */
export default function AssetListPage() {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  return <Navigate to={qs ? `/itam?${qs}` : '/itam'} replace />;
}
