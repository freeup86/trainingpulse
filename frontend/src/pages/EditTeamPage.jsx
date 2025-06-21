import { useParams } from 'react-router-dom';
import TeamForm from '../components/TeamForm';

export default function EditTeamPage() {
  const { id } = useParams();
  return <TeamForm teamId={id} />;
}