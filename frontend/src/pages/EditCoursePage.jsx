import { useParams } from 'react-router-dom';
import CourseForm from '../components/CourseForm';

export default function EditCoursePage() {
  const { id } = useParams();
  return <CourseForm courseId={id} />;
}