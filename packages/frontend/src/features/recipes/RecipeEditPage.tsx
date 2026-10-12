import { useParams } from 'react-router-dom';
import RecipeForm from './RecipeForm';

export default function RecipeEditPage() {
  const { id } = useParams<{ id: string }>();

  return <RecipeForm recipeId={id} />;
}
