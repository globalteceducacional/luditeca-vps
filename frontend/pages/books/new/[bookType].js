import BookTypeFlowPage from '../../../components/books/create/BookTypeFlowPage';
import { isValidBookType } from '../../../lib/bookTypes';

export default function NewBookByTypePage({ bookType }) {
  return <BookTypeFlowPage bookType={bookType} />;
}

export async function getServerSideProps({ params }) {
  const bookType = String(params?.bookType || '').trim();
  if (!isValidBookType(bookType)) {
    return {
      redirect: { destination: '/books/new', permanent: false },
    };
  }
  return { props: { bookType } };
}
